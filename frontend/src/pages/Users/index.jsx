import CrudModule from '@/modules/CrudModule/CrudModule';
import AdminForm from '@/forms/AdminForm';
import { fields } from './config';

import useLanguage from '@/locale/useLanguage';

export default function Users() {
  const translate = useLanguage();
  const entity = 'admin';
  const searchConfig = {
    displayLabels: ['name', 'email'],
    searchFields: ['name', 'email'],
  };
  const deleteModalLabels = ['name', 'email'];

  const Labels = {
    PANEL_TITLE: translate('users'),
    DATATABLE_TITLE: translate('users_list'),
    ADD_NEW_ENTITY: translate('add_new_user'),
    ENTITY_NAME: translate('user'),
  };

  const configPage = {
    entity,
    ...Labels,
  };

  const config = {
    ...configPage,
    fields,
    searchConfig,
    deleteModalLabels,
  };

  return (
    <CrudModule
      createForm={<AdminForm />}
      updateForm={<AdminForm isUpdateForm={true} />}
      config={config}
    />
  );
}