import './PageHero.css';

export default function PageHero({ title, subtitle, actions = null }) {
  return (
    <section className="page-hero">
      <div className="container page-hero__inner">
        <h1 className="page-hero__title">{title}</h1>
        {subtitle ? <p className="page-hero__subtitle">{subtitle}</p> : null}
        {actions ? <div className="page-hero__actions">{actions}</div> : null}
      </div>
    </section>
  );
}
