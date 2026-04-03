import PageHero from '../components/PageHero';
import PlaceholderCard from '../components/PlaceholderCard';

export default function LoginPage() {
  return (
    <>
      <PageHero title="Вход" subtitle="Страница-заготовка под твой login-компонент." />
      <section className="section">
        <div className="container single-column">
          <PlaceholderCard title="LoginForm" text="Сюда можно вставить твой JSX из страницы входа и подключить login.css." />
        </div>
      </section>
    </>
  );
}
