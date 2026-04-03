import PageHero from '../components/PageHero';
import PlaceholderCard from '../components/PlaceholderCard';

export default function RegisterPage() {
  return (
    <>
      <PageHero title="Регистрация" subtitle="Страница-заготовка под твой registration-компонент." />
      <section className="section">
        <div className="container single-column">
          <PlaceholderCard title="RegisterForm" text="Сюда можно вставить твой JSX из страницы регистрации и подключить registration.css." />
        </div>
      </section>
    </>
  );
}
