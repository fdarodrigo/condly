import { Bot } from 'lucide-react';
import { PreviewPlaceholder } from '@/components/layout/preview-placeholder';

export default function BotWhatsappPage() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center">
      <PreviewPlaceholder
        icone={Bot}
        titulo="Configurações do bot no WhatsApp"
        descricao="Configure aqui o que o bot pode responder automaticamente — disponível em breve."
      />
    </div>
  );
}
