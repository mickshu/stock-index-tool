import { Empty, Typography, Card } from 'antd';

export default function Screener() {
  return (
    <div>
      <Typography.Title level={4}>Stock Screener</Typography.Title>
      <Card>
        <Empty
          description={
            <span>
              Screener is not implemented yet.
              <br />
              Planned: filter watchlist stocks by signal type and indicator threshold.
            </span>
          }
        />
      </Card>
    </div>
  );
}
