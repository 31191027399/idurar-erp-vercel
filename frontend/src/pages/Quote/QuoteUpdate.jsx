import useLanguage from '@/locale/useLanguage';
import UpdateQuoteModule from '@/modules/QuoteModule/UpdateQuoteModule';

export default function QuoteUpdate() {
  const entity = 'quote';
  const translate = useLanguage();
  const Labels = {
    PANEL_TITLE: translate('quote'),
    DATATABLE_TITLE: translate('quote_list'),
    ENTITY_NAME: translate('quote'),
  };

  const configPage = { entity, ...Labels };
  return <UpdateQuoteModule config={configPage} />;
}
