import './PlaceholderCard.css';

export default function PlaceholderCard({ title, text, children }) {
  return (
    <article className="placeholder-card">
      <h2 className="placeholder-card__title">{title}</h2>
      {text ? <p className="placeholder-card__text">{text}</p> : null}
      {children}
    </article>
  );
}
