export default function Suporte() {
  const faqs = [
    { q: 'O bot opera sozinho enquanto meu computador está ligado?', a: 'Sim. Deixe o Manusia aberto e ele opera automaticamente conforme as estratégias configuradas. Basta ter conexão com a internet.' },
    { q: 'Posso usar conta demo para testar?',                        a: 'Sim! Na configuração do bot, selecione a conta Demo. Assim você testa as estratégias sem risco.' },
    { q: 'O que acontece se a internet cair?',                        a: 'O bot para de operar. Ao reconectar, você precisa fazer login novamente e reiniciar o bot.' },
    { q: 'Como funciona o Gale?',                                     a: 'Após um Loss, a próxima entrada dobra o valor (2x, 4x...). Ao vencer, volta ao valor base. O número de rounds limita quantas vezes dobra antes de resetar.' },
    { q: 'Como funciona o Soros?',                                    a: 'Após um Win, 100% do lucro é somado à próxima entrada, em até 3 níveis configuráveis. Após Loss ou após completar a cadeia, volta ao valor base.' },
    { q: 'Binary ou Digital Options — qual usar?',                    a: 'Binary tem payout fixo. Digital geralmente oferece payout maior mas com spread. Teste os dois na conta demo.' },
  ]

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Suporte</h1>
        <p className="page-subtitle">Perguntas frequentes e contato</p>
      </div>

      <div className="suporte-page-grid">
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <div className="faq-q">❓ {f.q}</div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>

        <div className="suporte-contato">
          <div className="contato-titulo">Precisa de ajuda?</div>
          <p className="contato-desc">Entre em contato pelo canal oficial da Broker10.</p>
        </div>
      </div>
    </div>
  )
}
