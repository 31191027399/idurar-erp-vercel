import CrudModule from '@/modules/CrudModule';
import useLanguage from '@/locale/useLanguage';

export default function Taxes() {
  const entity = 'taxes';
  const translate = useLanguage();

  const dataTableColumns = [
    { title: translate('Name'), dataIndex: 'taxName' },
    { title: translate('Rate'), dataIndex: 'taxValue' },
  ];

  const config = {
    entity,
    dataTableColumns,
    PANEL_TITLE: translate('taxes'),
    DATATABLE_TITLE: translate('taxes_list'),
    ADD_NEW_ENTITY: translate('add_new_tax'),
    ENTITY_NAME: translate('tax'),
  };

  return <CrudModule config={config} />;
}
