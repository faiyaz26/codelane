import { Hero } from '@/components/landing/Hero';
import { LegacyBloat } from '@/components/landing/LegacyBloat';
import { ProjectLanes } from '@/components/landing/ProjectLanes';
import { CodeReview } from '@/components/landing/CodeReview';
import { AgentIntegration } from '@/components/landing/AgentIntegration';
import { OpenSource } from '@/components/landing/OpenSource';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <LegacyBloat />
      <ProjectLanes />
      <CodeReview />
      <AgentIntegration />
      <OpenSource />
      <Footer />
    </main>
  );
}
