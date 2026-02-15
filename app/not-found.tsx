export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-gray-400">Page not found</p>
      </div>
    </div>
  );
}
