import { render, screen } from '@testing-library/react';
import { User } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPlaceholder } from './preview-placeholder';

describe('PreviewPlaceholder', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra título, descrição e o selo "Em breve", sem nenhuma chamada de rede', () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal('fetch', fetchEspiao);

    render(
      <PreviewPlaceholder
        icone={User}
        titulo="Perfil"
        descricao="Edite seus dados pessoais — disponível em breve."
      />,
    );

    expect(screen.getByText('Perfil')).toBeInTheDocument();
    expect(
      screen.getByText('Edite seus dados pessoais — disponível em breve.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('preview-em-breve')).toHaveTextContent('Em breve');
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it('não renderiza nenhum elemento de formulário', () => {
    render(<PreviewPlaceholder icone={User} titulo="Relatórios" descricao="x" />);

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    expect(document.querySelector('input')).toBeNull();
  });
});
