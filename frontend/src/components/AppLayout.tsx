import { Layout, Menu, Typography } from 'antd';
import {
  BarChartOutlined,
  StarOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <BarChartOutlined />, label: 'Dashboard' },
    { key: '/stocks', icon: <StarOutlined />, label: 'Watchlist' },
    { key: '/screener', icon: <SearchOutlined />, label: 'Screener' },
    { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <Typography.Title
          level={5}
          style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}
        >
          股票分析
        </Typography.Title>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff' }}>
          <Typography.Title level={4} style={{ margin: '16px 0' }}>
            Stock Analysis Tool
          </Typography.Title>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
