import { useState } from 'react';
import { Alert, Button, Card, Form, InputNumber, Space, Typography, message } from 'antd';
import { request } from '@/request';
import useLanguage from '@/locale/useLanguage';
import { useDispatch } from 'react-redux';
import { settingsAction } from '@/redux/settings/actions';

const { Paragraph, Text, Title } = Typography;
const DEFAULT_COUNTS = { clients: 20, quotes: 20, invoices: 20, payments: 20 };

export default function Maintenance() {
  const translate = useLanguage();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loadingAction, setLoadingAction] = useState('');
  const [seedResult, setSeedResult] = useState(null);

  const refreshSettings = () => {
    dispatch(settingsAction.list({ entity: 'setting' }));
  };

  const runAction = async ({ type, entity, payload, successMessage }) => {
    const confirmed = window.confirm(
      type === 'clean'
        ? translate('maintenance_clean_confirm')
        : translate('maintenance_seed_confirm')
    );

    if (!confirmed) return;

    setLoadingAction(type);
    const data = await request.post({ entity, jsonData: payload });
    setLoadingAction('');

    if (data?.success) {
      if (type === 'seed') {
        setSeedResult(data.result);
      } else {
        setSeedResult(null);
        refreshSettings();
      }
      message.success(successMessage);
      return;
    }

    message.error(data?.message || translate('maintenance_action_failed'));
  };

  const getSeedCounts = () => ({
    ...DEFAULT_COUNTS,
    ...form.getFieldsValue(true),
  });

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            Demo ERP Maintenance
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Clean existing ERP records or reseed a linked demo dataset without replacing the
            current admin users. Client, accepted quote, invoice, and payment counts default to 20
            records each and can be adjusted before seeding.
          </Paragraph>
        </div>

        <Alert
          type="warning"
          showIcon
          message="Owner-only maintenance actions"
          description="Cleaning removes current customers, quotes, invoices, payments, taxes, payment modes, and settings. Seeding preserves admin accounts, then rebuilds related ERP demo records that stay linked together."
        />

        <Form form={form} layout="vertical" initialValues={DEFAULT_COUNTS}>
          <Space wrap size="large">
            <Form.Item label="Clients" name="clients" style={{ minWidth: 120, marginBottom: 0 }}>
              <InputNumber min={1} max={200} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Accepted Quotes" name="quotes" style={{ minWidth: 140, marginBottom: 0 }}>
              <InputNumber min={0} max={200} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Invoices" name="invoices" style={{ minWidth: 120, marginBottom: 0 }}>
              <InputNumber min={0} max={200} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Linked Payments" name="payments" style={{ minWidth: 140, marginBottom: 0 }}>
              <InputNumber min={0} max={200} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
            Seeding creates customers, accepted quotes, invoices, and linked payments that follow
            the same ERP relationships. Current admin users stay unchanged.
          </Paragraph>
        </Form>

        <Space wrap>
          <Button
            danger
            loading={loadingAction === 'clean'}
            onClick={() =>
              runAction({
                type: 'clean',
                entity: 'admin/maintenance/clean',
                payload: {},
                successMessage: translate('maintenance_clean_success'),
              })
            }
          >
            {translate('maintenance_clean_action')}
          </Button>

          <Button
            type="primary"
            loading={loadingAction === 'seed'}
            onClick={() =>
              runAction({
                type: 'seed',
                entity: 'admin/maintenance/seed',
                payload: { clean: true, counts: getSeedCounts() },
                successMessage: 'ERP demo data cleaned and seeded successfully.',
              })
            }
          >
            Seed Demo Data
          </Button>
        </Space>

        {seedResult && (
          <Alert
            type="success"
            showIcon
            message="Demo data ready"
            description={
              <Space direction="vertical" size="small">
                <Text>Owner preserved: {seedResult.owner.email}</Text>
                <Text>
                  Seeded {seedResult.summary.clients} clients, {seedResult.summary.quotes}{' '}
                  accepted quotes, {seedResult.summary.invoices} invoices, and{' '}
                  {seedResult.summary.payments} linked payments.
                </Text>
              </Space>
            }
          />
        )}
      </Space>
    </Card>
  );
}
