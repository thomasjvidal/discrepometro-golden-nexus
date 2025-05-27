import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-dark-900/50 backdrop-blur-sm border-b border-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-xl font-bold text-white">Discrepômetro</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/')
                      ? 'bg-dark-800 text-white'
                      : 'text-gray-300 hover:bg-dark-800 hover:text-white'
                  }`}
                >
                  Upload
                </Link>
                <Link
                  to="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/dashboard')
                      ? 'bg-dark-800 text-white'
                      : 'text-gray-300 hover:bg-dark-800 hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/discrepometro"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/discrepometro')
                      ? 'bg-dark-800 text-white'
                      : 'text-gray-300 hover:bg-dark-800 hover:text-white'
                  }`}
                >
                  Análise de Inventário
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 