import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { CopyOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';

import { request } from '@/request';

const { Paragraph, Text, Title } = Typography;

const formatDate = (value) => {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
};

const maskPrefix = (prefix) => {
  if (!prefix) return 'Hidden';
  return `${prefix}...`;
};

const onlyVisibleApiKeys = (keys) => keys.filter((key) => !key.revoked);

export default function ApiKeys() {
  const [form] = Form.useForm();
  const [integrationForm] = Form.useForm();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [latestKey, setLatestKey] = useState(null);

  const loadIntegrationSettings = async () => {
    setIntegrationLoading(true);
    const data = await request.get({ entity: 'admin/integration-settings' });

    if (data?.success) {
      integrationForm.setFieldsValue({
        serviceName: data.result?.serviceName || '',
        baseUrl: data.result?.baseUrl || '',
        apiKey: data.result?.apiKey || '',
      });
    } else {
      message.error(data?.message || 'Failed to load integration settings.');
    }

    setIntegrationLoading(false);
  };

  const loadApiKeys = async () => {
    setLoading(true);
    const data = await request.get({ entity: 'admin/api-key/list' });
    if (data?.success) {
      setApiKeys(Array.isArray(data.result) ? onlyVisibleApiKeys(data.result) : []);
    } else {
      message.error(data?.message || 'Failed to load API keys.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIntegrationSettings();
    loadApiKeys();
  }, []);

  const handleCopy = async (value, successText) => {
    if (!value) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      message.success(successText);
    } catch (error) {
      message.error('Copy failed. Please copy it manually.');
    }
  };

  const handleCreate = async (values) => {
    setCreating(true);
    const payload = {
      name: values.name,
      scopes: values.scopes
        ? values.scopes
            .split(',')
            .map((scope) => scope.trim())
            .filter(Boolean)
        : [],
      expiresInDays: values.expiresInDays ?? null,
    };

    const data = await request.post({
      entity: 'admin/api-key/create',
      jsonData: payload,
    });

    setCreating(false);

    if (data?.success) {
      setLatestKey(data.result);
      form.resetFields();
      loadApiKeys();
      message.success('API key created.');
      return;
    }

    message.error(data?.message || 'Failed to create API key.');
  };

  const handleIntegrationSave = async (values) => {
    setIntegrationSaving(true);
    const data = await request.patch({
      entity: 'admin/integration-settings',
      jsonData: {
        serviceName: values.serviceName?.trim?.() || '',
        baseUrl: values.baseUrl?.trim?.() || '',
        apiKey: values.apiKey || '',
      },
    });
    setIntegrationSaving(false);

    if (data?.success) {
      integrationForm.setFieldsValue({
        serviceName: data.result?.serviceName || '',
        baseUrl: data.result?.baseUrl || '',
        apiKey: data.result?.apiKey || '',
      });
      message.success('Integration settings saved.');
      return;
    }

    message.error(data?.message || 'Failed to save integration settings.');
  };

  const handleRevoke = async (id) => {
    setRevokingId(id);
    const data = await request.patch({
      entity: `admin/api-key/revoke/${id}`,
      jsonData: {},
    });
    setRevokingId('');

    if (data?.success) {
      setApiKeys((currentKeys) => currentKeys.filter((key) => key._id !== id));
      message.success('API key revoked.');
      return;
    }

    message.error(data?.message || 'Failed to revoke API key.');
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>
          API Keys
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Manage outbound third-party credentials and create long-lived credentials for external
          tools. Protected API routes now accept either
          <Text code style={{ marginInline: 4 }}>
            Authorization: Bearer &lt;api_key&gt;
          </Text>
          or
          <Text code style={{ marginInline: 4 }}>
            X-API-Key: &lt;api_key&gt;
          </Text>
          .
        </Paragraph>
      </div>

      <Alert
        type="info"
        showIcon
        message="Store the secret when it is created"
        description="For safety, full API keys are only shown once right after creation. Existing keys in the list are masked and can only be revoked."
      />

      {latestKey && (
        <Alert
          type="success"
          showIcon
          message="New API key created"
          description={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong>{latestKey.name}</Text>
              <Paragraph copyable={false} style={{ marginBottom: 0 }}>
                <Text code>{latestKey.key}</Text>
              </Paragraph>
              <Space wrap>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(latestKey.key, 'API key copied.')}
                >
                  Copy Key
                </Button>
                <Button
                  onClick={() =>
                    handleCopy(
                      `Authorization: Bearer ${latestKey.key}`,
                      'Bearer header copied.'
                    )
                  }
                >
                  Copy Bearer Header
                </Button>
                <Button type="link" onClick={() => setLatestKey(null)} style={{ paddingInline: 0 }}>
                  Hide Key
                </Button>
              </Space>
            </Space>
          }
        />
      )}

      <Card
        title="3rd-Party Integration"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadIntegrationSettings} loading={integrationLoading}>
            Refresh
          </Button>
        }
      >
        <Form form={integrationForm} layout="vertical" onFinish={handleIntegrationSave}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Store credentials for outbound integrations"
              description="Use this section to save the service details and API key required when this ERP connects to another platform."
            />

            <Form.Item
              label="Service Name"
              name="serviceName"
              rules={[{ required: true, message: 'Please enter the 3rd-party service name.' }]}
            >
              <Input placeholder="Stripe, Zapier, Slack, Custom ERP API" />
            </Form.Item>

            <Form.Item
              label="Base URL"
              name="baseUrl"
              rules={[
                { required: true, message: 'Please enter the integration base URL.' },
                { type: 'url', message: 'Please enter a valid URL.' },
              ]}
            >
              <Input placeholder="https://api.example.com" />
            </Form.Item>

            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: true, message: 'Please enter the API key.' }]}
              extra="This value is stored on the server and only visible to authenticated admins on this screen."
            >
              <Input.Password
                placeholder="Paste the third-party API key"
                autoComplete="new-password"
              />
            </Form.Item>

            <Space wrap>
              <Button type="primary" htmlType="submit" loading={integrationSaving}>
                Save Integration Settings
              </Button>
              <Button onClick={() => integrationForm.resetFields()} disabled={integrationLoading}>
                Reset
              </Button>
            </Space>
          </Space>
        </Form>
      </Card>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ expiresInDays: 365 }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="Generated API keys are for inbound access"
              description="Create a generated key below when another system needs to call this ERP's protected API routes."
            />

            <Form.Item
              label="Key Name"
              name="name"
              rules={[{ required: true, message: 'Please enter a label for this key.' }]}
            >
              <Input placeholder="Zapier Production" />
            </Form.Item>

            <Form.Item
              label="Scopes"
              name="scopes"
              extra="Optional comma-separated labels for your own tracking, for example invoice:read, client:list"
            >
              <Input placeholder="invoice:read, client:list" />
            </Form.Item>

            <Form.Item
              label="Expires In Days"
              name="expiresInDays"
              extra="Leave a value here to set automatic expiry, or clear it for a non-expiring key."
            >
              <InputNumber min={1} max={3650} style={{ width: '100%' }} />
            </Form.Item>

            <Space wrap>
              <Button type="primary" htmlType="submit" loading={creating} icon={<PlusOutlined />}>
                Create API Key
              </Button>
              <Button onClick={() => form.resetFields()}>Reset</Button>
            </Space>
          </Space>
        </Form>
      </Card>

      <Card
        title="Existing Keys"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadApiKeys} loading={loading}>
            Refresh
          </Button>
        }
      >
        <List
          loading={loading}
          locale={{ emptyText: <Empty description="No API keys created yet." /> }}
          dataSource={apiKeys}
          renderItem={(item) => {
            const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();

            return (
              <List.Item
                actions={[
                  <Button
                    key="copy-prefix"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopy(item.keyPrefix, 'Key prefix copied.')}
                  >
                    Copy Prefix
                  </Button>,
                  <Popconfirm
                    key="revoke"
                    title="Revoke API key?"
                    description="External tools using this key will stop working immediately."
                    onConfirm={() => handleRevoke(item._id)}
                    okText="Revoke"
                    cancelText="Cancel"
                  >
                    <Button danger icon={<StopOutlined />} loading={revokingId === item._id}>
                      Revoke
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Text strong>{item.name}</Text>
                      <Tag color={isExpired ? 'orange' : 'green'}>
                        {isExpired ? 'Expired' : 'Active'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text code>{maskPrefix(item.keyPrefix)}</Text>
                      <Text type="secondary">Created: {formatDate(item.created)}</Text>
                      <Text type="secondary">Last used: {formatDate(item.lastUsedAt)}</Text>
                      <Text type="secondary">Expires: {formatDate(item.expiresAt)}</Text>
                      {Array.isArray(item.scopes) && item.scopes.length > 0 && (
                        <Space wrap>
                          {item.scopes.map((scope) => (
                            <Tag key={scope}>{scope}</Tag>
                          ))}
                        </Space>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </Space>
  );
}
