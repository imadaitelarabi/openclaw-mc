"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ExtensionModalProps } from "@/types/extension";

type ModalComponentMap = Record<string, React.ComponentType<ExtensionModalProps<any, any>>>;

interface ActiveModalState {
  modalId: string;
  payload: unknown;
}

interface ExtensionModalContextValue {
  openModal: <TPayload = unknown, TResult = unknown>(
    modalId: string,
    payload?: TPayload
  ) => Promise<TResult | undefined>;
  closeModal: () => void;
}

const ExtensionModalContext = createContext<ExtensionModalContextValue | undefined>(undefined);

export function useExtensionModals() {
  const context = useContext(ExtensionModalContext);
  if (!context) {
    throw new Error("useExtensionModals must be used within an ExtensionModalProvider");
  }
  return context;
}

export function useOptionalExtensionModals() {
  return useContext(ExtensionModalContext);
}

interface ExtensionModalProviderProps {
  extensionName: string;
  modals?: ModalComponentMap;
  children: ReactNode;
}

export function ExtensionModalProvider({
  extensionName,
  modals,
  children,
}: ExtensionModalProviderProps) {
  const [activeModal, setActiveModal] = useState<ActiveModalState | null>(null);
  const resolverRef = useRef<((value: unknown) => void) | null>(null);

  const dismissInternal = useCallback((value: unknown) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setActiveModal(null);
  }, []);

  const openModal = useCallback(
    <TPayload, TResult>(modalId: string, payload?: TPayload): Promise<TResult | undefined> => {
      const ModalComponent = modals?.[modalId];
      if (!ModalComponent) {
        return Promise.reject(
          new Error(`Modal \"${modalId}\" is not registered for extension \"${extensionName}\"`)
        );
      }

      if (resolverRef.current) {
        resolverRef.current(undefined);
        resolverRef.current = null;
      }

      setActiveModal({
        modalId,
        payload: payload ?? null,
      });

      return new Promise<TResult | undefined>((resolve) => {
        resolverRef.current = (value: unknown) => resolve(value as TResult | undefined);
      });
    },
    [modals, extensionName]
  );

  const closeModal = useCallback(() => {
    dismissInternal(undefined);
  }, [dismissInternal]);

  const value = useMemo<ExtensionModalContextValue>(
    () => ({
      openModal,
      closeModal,
    }),
    [openModal, closeModal]
  );

  const ActiveModalComponent = activeModal ? modals?.[activeModal.modalId] : undefined;

  return (
    <ExtensionModalContext.Provider value={value}>
      {children}
      {ActiveModalComponent && activeModal && (
        <ActiveModalComponent
          extensionName={extensionName}
          modalId={activeModal.modalId}
          isOpen
          payload={activeModal.payload}
          onResolve={(result) => dismissInternal(result)}
          onClose={() => dismissInternal(undefined)}
        />
      )}
    </ExtensionModalContext.Provider>
  );
}
