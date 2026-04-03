import PlaceholderCard from '../components/PlaceholderCard';
import PageHero from '../components/PageHero';

export default function EventsPage() {
  return (
    <>
      <PageHero
        title="Страница мероприятий"
        subtitle="Сюда удобно вставить твой компонент списка мероприятий или готовую страницу events-list.jsx."
      />

      <section className="section">
        <div className="container grid grid--2">
          <PlaceholderCard title="EventsList" text="Заменить этот блок своим компонентом списка мероприятий." />
          <PlaceholderCard title="Filters" text="Здесь можно подключить фильтры, категории и поиск." />
        </div>
      </section>
    </>
  );
}
