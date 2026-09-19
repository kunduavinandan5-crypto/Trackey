export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
