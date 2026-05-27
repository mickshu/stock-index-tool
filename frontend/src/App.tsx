import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Watchlist from './pages/Watchlist';
import StockDetail from './pages/StockDetail';
import Screener from './pages/Screener';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<Watchlist />} />
            <Route path="stock/:code" element={<StockDetail />} />
            <Route path="screener" element={<Screener />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
