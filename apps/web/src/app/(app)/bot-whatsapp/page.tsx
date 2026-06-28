import { Bot } from 'lucide-react';
import { PreviewPlaceholder } from '@/components/layout/preview-placeholder';

export default function BotWhatsappPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Configurações do bot no WhatsApp</h1>
      <PreviewPlaceholder
        icone={Bot}
        titulo="Configurações do bot no WhatsApp"
        descricao="Configure aqui o que o bot pode responder automaticamente — disponível em breve."
      />
    </>
  );
}
