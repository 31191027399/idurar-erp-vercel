import { useState } from 'react';
import { Alert, Button, Card, Space, Typography, message } from 'antd';
import { request } from '@/request';
import useLanguage from '@/locale/useLanguage';
import { useDispatch } from 'react-redux';
import { settingsAction } from '@/redux/settings/actions';

const { Paragraph, Text, Title } = Typography;

export default function Maintenance() {
  const translate = useLanguage();
  const dispatch = useDispatch();
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

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            {translate('maintenance_tools')}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {translate('maintenance_tools_description')}
          </Paragraph>
        </div>

        <Alert
          type="warning"
          showIcon
          message={translate('maintenance_warning_title')}
          description={translate('maintenance_warning_description')}
        />

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
                payload: { clean: true },
                successMessage: translate('maintenance_seed_success'),
              })
            }
          >
            {translate('maintenance_seed_action')}
          </Button>
        </Space>

        {seedResult && (
          <Alert
            type="success"
            showIcon
            message={translate('maintenance_seed_result')}
            description={
              <Space direction="vertical" size="small">
                <Text>
                  {translate('maintenance_owner_login')}: {seedResult.owner.email} /{' '}
                  {seedResult.owner.password}
                </Text>
                <Text>
                  {translate('maintenance_manager_login')}: {seedResult.manager.email} /{' '}
                  {seedResult.manager.password}
                </Text>
                <Text>
                  {translate('maintenance_seeded_summary')} {seedResult.summary.clients}{' '}
                  {translate('customers').toLowerCase()}, {seedResult.summary.quotes}{' '}
                  {translate('quotes').toLowerCase()}, {seedResult.summary.invoices}{' '}
                  {translate('invoices').toLowerCase()}, {seedResult.summary.payments}{' '}
                  {translate('payments').toLowerCase()}.
                </Text>
                <Text type="warning">{translate('maintenance_relogin_notice')}</Text>
              </Space>
            }
          />
        )}
      </Space>
    </Card>
  );
}
