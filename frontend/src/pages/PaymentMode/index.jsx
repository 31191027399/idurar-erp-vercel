import CrudModule from '@/modules/CrudModule';
import useLanguage from '@/locale/useLanguage';

export default function PaymentMode() {
  const entity = 'paymentMode';
  const translate = useLanguage();

  const dataTableColumns = [
    { title: translate('Name'), dataIndex: 'name' },
    { title: translate('Description'), dataIndex: 'description' },
  ];

  const config = {
    entity,
    dataTableColumns,
    PANEL_TITLE: translate('payment_mode'),
    DATATABLE_TITLE: translate('payment_mode_list'),
    ADD_NEW_ENTITY: translate('add_new_payment_mode'),
    ENTITY_NAME: translate('payment_mode'),
  };

  return <CrudModule config={config} />;
}
