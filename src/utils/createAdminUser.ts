import { supabase } from '@/integrations/supabase/client';

export const createAdminUser = async () => {
  try {
    // Sign up the admin user
    const { data, error } = await supabase.auth.signUp({
      email: 'admin@rockmundo.com',
      password: 'admin123',
      options: {
        data: {
          username: 'admin',
          display_name: 'Admin User'
        },
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) throw error;

    if (data.user) {
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the user role to admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', data.user.id);

      if (roleError) throw roleError;

      // Update profile with admin stats
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          cash: 1000000,
          fame: 10000,
          level: 10,
          experience: 5000
        })
        .eq('user_id', data.user.id);

      if (profileError) throw profileError;

      // Update skills
      const { error: skillsError } = await supabase
        .from('player_skills')
        .update({
          guitar: 95,
          vocals: 95,
          drums: 95,
          bass: 95,
          performance: 95,
          songwriting: 95
        })
        .eq('user_id', data.user.id);

      if (skillsError) throw skillsError;

      console.log('Admin user created successfully!');
      return { success: true, user: data.user };
    }

    return { success: false, error: 'User creation failed' };
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return { success: false, error: error.message };
  }
};