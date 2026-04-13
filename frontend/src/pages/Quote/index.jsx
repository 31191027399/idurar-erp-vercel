import dayjs from 'dayjs';
import { Tag } from 'antd';
import useLanguage from '@/locale/useLanguage';
import { tagColor } from '@/utils/statusTagColor';
import { useMoney, useDate } from '@/settings';
import QuoteDataTableModule from '@/modules/QuoteModule/QuoteDataTableModule';

export default function Quote() {
  const translate = useLanguage();
  const { dateFormat } = useDate();
  const entity = 'quote';
  const { moneyFormatter } = useMoney();

  const searchConfig = {
    entity: 'client',
    displayLabels: ['name'],
    searchFields: 'name',
  };
  
  const deleteModalLabels = ['number', 'client.name'];
  
  const dataTableColumns = [
    { title: translate('Number'), dataIndex: 'number' },
    { title: translate('Client'), dataIndex: ['client', 'name'] },
    {
      title: translate('Date'),
      dataIndex: 'date',
      render: (date) => date ? dayjs(date).format(dateFormat) : '-',
    },
    {
      title: translate('Total'),
      dataIndex: 'total',
      onCell: () => ({ style: { textAlign: 'right', whiteSpace: 'nowrap', direction: 'ltr' } }),
      render: (total, record) => total ? moneyFormatter({ amount: total, currency_code: record.currency }) : '-',
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
      render: (status) => status ? <Tag color={tagColor(status)?.color}>{translate(status)}</Tag> : '-',
    },
  ];

  const Labels = {
    PANEL_TITLE: translate('quote'),
    DATATABLE_TITLE: translate('quote_list'),
    ADD_NEW_ENTITY: translate('add_new_quote'),
    ENTITY_NAME: translate('quote'),
  };

  const config = {
    entity,
    ...Labels,
    dataTableColumns,
    searchConfig,
    deleteModalLabels,
  };

  return <QuoteDataTableModule config={config} />;
}
