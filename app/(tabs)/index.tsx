import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const { t } = require('react-i18next');
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">{t('tabs.welcome', 'Welcome!')}</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">{t('tabs.step1', 'Step 1: Try it')}</ThemedText>
        <ThemedText>
          {t('tabs.editInstruction', 'Edit')} <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> {t('tabs.seeChanges', 'to see changes.')}
          {t('tabs.press', 'Press')}{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: t('tabs.iosShortcut', 'cmd + d'),
              android: t('tabs.androidShortcut', 'cmd + m'),
              web: t('tabs.webShortcut', 'F12'),
            })}
          </ThemedText>{' '}
          {t('tabs.openDevTools', 'to open developer tools.')}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">{t('tabs.step2', 'Step 2: Explore')}</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title={t('tabs.action', 'Action')} icon="cube" onPress={() => alert(t('tabs.actionPressed', 'Action pressed'))} />
            <Link.MenuAction
              title={t('tabs.share', 'Share')}
              icon="square.and.arrow.up"
              onPress={() => alert(t('tabs.sharePressed', 'Share pressed'))}
            />
            <Link.Menu title={t('tabs.more', 'More')} icon="ellipsis">
              <Link.MenuAction
                title={t('tabs.delete', 'Delete')}
                icon="trash"
                destructive
                onPress={() => alert(t('tabs.deletePressed', 'Delete pressed'))}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {t('tabs.exploreInstruction', "Tap the Explore tab to learn more about what's included in this starter app.")}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">{t('tabs.step3', 'Step 3: Get a fresh start')}</ThemedText>
        <ThemedText>
          {t('tabs.readyInstruction', "When you're ready, run ")}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> {t('tabs.getFresh', 'to get a fresh')}{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> {t('tabs.directory', 'directory. This will move the current')}{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> {t('tabs.to', 'to')}{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
