import useLanguage from '@/locale/useLanguage';
import ReadQuoteModule from '@/modules/QuoteModule/ReadQuoteModule';

export default function QuoteRead() {
  const entity = 'quote';
  const translate = useLanguage();
  const Labels = {
    PANEL_TITLE: translate('quote'),
    DATATABLE_TITLE: translate('quote_list'),
    ENTITY_NAME: translate('quote'),
  };

  const configPage = { entity, ...Labels };
  return <ReadQuoteModule config={configPage} />;
}
