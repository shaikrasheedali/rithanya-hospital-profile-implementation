import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink/70">{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className="mt-6 rounded-full bg-royal px-6 py-3 font-semibold text-white">
        Reload page
      </button>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[app] uncaught render error:", error);
  }
  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} reset={() => { this.setState({ error: null }); window.location.reload(); }} />;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster richColors closeButton position="top-right" toastOptions={{ duration: 4500 }} />
    </ErrorBoundary>
  </React.StrictMode>,
);
