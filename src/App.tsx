import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { SalesPage } from './pages/SalesPage'
import { PurchasesPage } from './pages/PurchasesPage'
import { ReceivablesPage } from './pages/ReceivablesPage'
import { PayablesPage } from './pages/PayablesPage'
import { CashLedgerPage } from './pages/CashLedgerPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PartiesPage } from './pages/PartiesPage'
import { SetupPage } from './pages/SetupPage'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { ReturnsPage } from './pages/ReturnsPage'
import { AdminPage } from './pages/AdminPage'
import { ManualProfitLossPage } from './pages/ManualProfitLossPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute><PurchasesPage /></ProtectedRoute>} />
          <Route path="/receivables" element={<ProtectedRoute><ReceivablesPage /></ProtectedRoute>} />
          <Route path="/payables" element={<ProtectedRoute><PayablesPage /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute><ReturnsPage /></ProtectedRoute>} />
          <Route path="/parties" element={<ProtectedRoute><PartiesPage /></ProtectedRoute>} />
          <Route path="/cash-ledger" element={<ProtectedRoute><CashLedgerPage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/manual-profit-loss" element={<ProtectedRoute><ManualProfitLossPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
