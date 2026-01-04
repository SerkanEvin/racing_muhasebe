import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { MembershipFees } from './pages/MembershipFees';
import { MerchSales } from './pages/MerchSales';
import { Reimbursements } from './pages/Reimbursements';
import { BankImport } from './pages/BankImport';
import { CashExpenses } from './pages/CashExpenses';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <Members />;
      case 'fees':
        return <MembershipFees />;
      case 'merch':
        return <MerchSales />;
      case 'reimbursements':
        return <Reimbursements />;
      case 'bank':
        return <BankImport />;
      case 'cash':
        return <CashExpenses />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
