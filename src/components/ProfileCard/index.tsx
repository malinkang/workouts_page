import styles from './style.module.scss';

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 4l11.733 16h4.267l-11.733 -16l-4.267 0" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </svg>
);

const WeiboIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M19 14.127c0 3.073 -3.502 5.873 -8 5.873c-4.126 0 -8 -2.224 -8 -5.565c0 -1.78 .984 -3.737 2.7 -5.567c2.362 -2.51 5.193 -3.687 6.551 -2.238c.415 .44 .752 1.39 .749 2.062c2 -1.615 4.308 .387 3.5 2.693c1.26 .557 2.5 .538 2.5 2.742" />
    <path d="M15 4h1a5 5 0 0 1 5 5v1" />
  </svg>
);

const socials = [
  { name: 'GitHub', href: 'https://github.com/malinkang', icon: GithubIcon },
  { name: 'X', href: 'https://x.com/malinkang', icon: XIcon },
  { name: '微博', href: 'https://webo.com/malinkang', icon: WeiboIcon },
];

const ProfileCard = () => {
  return (
    <section className={styles.card}>
      <img
        className={styles.avatar}
        src="https://avatars.githubusercontent.com/u/3365208?v=4"
        alt="malinkang avatar"
      />
      <div className={styles.socials}>
        {socials.map(({ name, href, icon: Icon }) => (
          <a key={name} className={styles.socialLink} href={href} target="_blank" rel="noreferrer" aria-label={name} title={name}>
            <span className={styles.socialIcon}>
              <Icon />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

export default ProfileCard;
