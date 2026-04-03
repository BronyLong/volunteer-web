import PageHero from '../components/PageHero';
import PlaceholderCard from '../components/PlaceholderCard';

export default function ProfilePage() {
  return (
    <>
      <PageHero title="Профиль" subtitle="Страница для подключения твоих profile-компонентов." />
      <section className="section">
        <div className="container grid grid--2">
          <PlaceholderCard title="ProfileSummary" text="Блок с аватаром, именем и ролью пользователя." />
          <PlaceholderCard title="ProfileInfo" text="Основная информация, bio, соцсети и кнопки действий." />
        </div>
      </section>
    </>
  );
}
