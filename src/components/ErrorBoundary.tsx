import { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  declare setState: (state: Partial<State> | ((prevState: Readonly<State>, props: Readonly<Props>) => Partial<State> | State | null), callback?: () => void) => void;
  declare props: Readonly<Props> & Readonly<{ children?: ReactNode }>;

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught rendering error:', error, errorInfo);
  }

  private handleRecover = () => {
    localStorage.clear();
    sessionStorage.clear();
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-sans text-white p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Recuperação Automática da Interface</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Identificamos uma inconsistência temporária de estado na renderização. A aplicação preveniu a falha de exibição e está pronta para restaurar a sessão com segurança.
            </p>
            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-left font-mono text-[10px] text-rose-400 overflow-x-auto max-h-28">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleRecover}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Restaurar Painel e Ir para Login</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
