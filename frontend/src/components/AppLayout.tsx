import { useState } from 'react';
import { Layout, Menu, Typography, Grid } from 'antd';
import {
  BarChartOutlined,
  StarOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.lg;

  const menuItems = [
    { key: '/', icon: <BarChartOutlined />, label: '仪表盘' },
    { key: '/stocks', icon: <StarOutlined />, label: '自选股' },
    { key: '/screener', icon: <SearchOutlined />, label: '选股扫描' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        trigger={isMobile ? null : undefined}
      >
        <Typography.Title
          level={5}
          style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}
        >
          {collapsed ? '股' : '股票分析'}
        </Typography.Title>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            if (isMobile) setCollapsed(true);
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography.Title
            level={4}
            style={{
              margin: isMobile ? '8px 0' : '16px 0',
              fontSize: isMobile ? 16 : undefined,
            }}
          >
            Stock Analysis Tool
          </Typography.Title>
        </Header>
        <Content
          style={{
            margin: isMobile ? 8 : 16,
            padding: isMobile ? 12 : 24,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
