
import { Client } from '@replit/object-storage';

async function cleanupObjectStorage() {
  console.log('Starting Object Storage cleanup...');

  try {
    const client = new Client();
    
    // List all keys in Object Storage
    const keys = await client.list();
    console.log(`Found ${keys.length} files in Object Storage`);

    // Delete all files
    for (const key of keys) {
      console.log(`Deleting: ${key}`);
      await client.delete(key);
    }

    console.log('\n✅ Object Storage cleanup completed!');
    console.log(`Deleted ${keys.length} files`);

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

cleanupObjectStorage()
  .then(() => {
    console.log('\nCleanup script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup script failed:', error);
    process.exit(1);
  });
