import React from 'react';
import { SkillTree } from '@/components/SkillTree';
import { Layout } from '@/components/Layout';

const SkillsPage: React.FC = () => {
  return (
    <Layout>
      <div className="container mx-auto p-6">
        <SkillTree />
      </div>
    </Layout>
  );
};

export default SkillsPage;