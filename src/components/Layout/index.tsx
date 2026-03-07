import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import styles from './style.module.scss';

type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'workouts-page-theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

interface LayoutProps extends React.PropsWithChildren {
  toolbarContent?: React.ReactNode;
}

const Layout = ({ children, toolbarContent }: LayoutProps) => {
  const { siteTitle, description, keywords } = useSiteMetadata();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <>
      <Helmet bodyAttributes={{ class: styles.body }}>
        <html lang="zh" />
        <title>{siteTitle}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta name="theme-color" content={theme === 'dark' ? '#151516' : '#f4f5ef'} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
      </Helmet>
      <div className="top-toolbar">
        {toolbarContent}
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
          title={theme === 'dark' ? '日间模式' : '夜间模式'}
        >
          {theme === 'dark' ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></g></svg>
              <span>日间</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M20.742 13.045a8.09 8.09 0 0 1-9.787-9.787a1 1 0 0 0-1.326-1.17A10.002 10.002 0 1 0 21.912 14.37a1 1 0 0 0-1.17-1.326"/></svg>
              <span>夜间</span>
            </>
          )}
        </button>
      </div>
      <div className="">{children}</div>
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  toolbarContent: PropTypes.node,
};

export default Layout;
