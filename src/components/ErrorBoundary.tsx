import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface in the console too.
    console.error("App crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 space-y-2 rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
          <h1 className="text-base font-bold">Something broke</h1>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-red-300">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
