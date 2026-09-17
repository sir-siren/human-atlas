import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/button/button";

export interface ErrorBoundaryProps {
    readonly children: ReactNode;
    readonly fallback?: ReactNode;
}

interface ErrorBoundaryState {
    readonly hasError: boolean;
    readonly error: Error | null;
}

/**
 * Replace a failed descendant render with a supplied fallback or a reload screen.
 *
 * Logs React-caught errors. The default recovery reloads the page; it does not retry children
 * in place. Event-handler and asynchronous failures must be handled by their owners.
 */
export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    public override state: ErrorBoundaryState = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
        };
    }

    public override componentDidCatch(
        error: Error,
        errorInfo: ErrorInfo,
    ): void {
        console.error("Uncaught error in UI component tree:", error, errorInfo);
    }

    private readonly handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
        });
        window.location.reload();
    };

    public override render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    role="alert"
                    className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center"
                >
                    <div className="glass max-w-md rounded-xl p-8 shadow-xl">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertCircle size={24} />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Something went wrong
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            {this.state.error?.message ||
                                "An unexpected error occurred while displaying the application."}
                        </p>
                        <div className="mt-6 flex justify-center">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={this.handleReset}
                            >
                                <RefreshCw size={16} />
                                Reload Application
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
