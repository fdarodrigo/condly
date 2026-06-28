import { User } from 'lucide-react';
import { PreviewPlaceholder } from '@/components/layout/preview-placeholder';

export default function PerfilPage() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center">
      <PreviewPlaceholder
        icone={User}
        titulo="Perfil"
        descricao="Edite seus dados pessoais, foto e preferências de conta — disponível em breve."
      />
    </div>
  );
}
