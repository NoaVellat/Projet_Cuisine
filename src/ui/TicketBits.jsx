// Habillage commun des bons : en-tête de la maison, numéro fantôme,
// code-barres et pied de ticket — la DA « ticket thermique ».
// Partagé entre les tickets projetés en 3D (Kitchen.jsx) et leurs équivalents
// dockés en DOM sur mobile (BoardPanel/ContactPanel/ChefPanel).
export function TicketBody({ kicker, title, num, children, footer = 'le poste · service continu' }) {
  return (
    <>
      <header className="ticket-head">
        <p className="ticket-brand">◆ Le Poste — cuisine du chef ◆</p>
        {num && <span className="ticket-num">{num}</span>}
        <p className="ticket-kicker">{kicker}</p>
        <h2>{title}</h2>
      </header>
      {children}
      <div className="barcode" aria-hidden="true" />
      <p className="ticket-foot">{footer}</p>
    </>
  );
}

export function Chips({ items, color }) {
  const style = color ? { borderColor: color, color, background: `${color}14` } : undefined;
  return (
    <div className="chips">
      {items.map((t) => (
        <span className="chip" key={t} style={style}>
          {t}
        </span>
      ))}
    </div>
  );
}
