
import { db } from '../server/db';
import { 
  posts, 
  payments, 
  comments, 
  votes, 
  notifications, 
  viralNotifications,
  investors,
  platformFees,
  pinnedPosts,
  commentLikes
} from '../shared/schema';

async function cleanupAllContent() {
  console.log('Starting cleanup of ALL content while preserving users...');

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete comment likes
    const deletedCommentLikes = await db
      .delete(commentLikes)
      .returning();
    console.log(`Deleted ${deletedCommentLikes.length} comment likes`);

    // 2. Delete platform fees
    const deletedPlatformFees = await db
      .delete(platformFees)
      .returning();
    console.log(`Deleted ${deletedPlatformFees.length} platform fees`);

    // 3. Delete pinned posts
    const deletedPinnedPosts = await db
      .delete(pinnedPosts)
      .returning();
    console.log(`Deleted ${deletedPinnedPosts.length} pinned posts`);

    // 4. Delete investors
    const deletedInvestors = await db
      .delete(investors)
      .returning();
    console.log(`Deleted ${deletedInvestors.length} investors`);

    // 5. Delete viral notifications
    const deletedViralNotifications = await db
      .delete(viralNotifications)
      .returning();
    console.log(`Deleted ${deletedViralNotifications.length} viral notifications`);

    // 6. Delete all notifications
    const deletedNotifications = await db
      .delete(notifications)
      .returning();
    console.log(`Deleted ${deletedNotifications.length} notifications`);

    // 7. Delete votes
    const deletedVotes = await db
      .delete(votes)
      .returning();
    console.log(`Deleted ${deletedVotes.length} votes`);

    // 8. Delete comments
    const deletedComments = await db
      .delete(comments)
      .returning();
    console.log(`Deleted ${deletedComments.length} comments`);

    // 9. Delete payments
    const deletedPayments = await db
      .delete(payments)
      .returning();
    console.log(`Deleted ${deletedPayments.length} payments`);

    // 10. Finally, delete all posts
    const deletedPosts = await db
      .delete(posts)
      .returning();
    console.log(`Deleted ${deletedPosts.length} posts`);

    console.log('\n✅ Cleanup completed successfully!');
    console.log('Summary:');
    console.log(`  - Posts deleted: ${deletedPosts.length}`);
    console.log(`  - Payments deleted: ${deletedPayments.length}`);
    console.log(`  - Comments deleted: ${deletedComments.length}`);
    console.log(`  - Comment Likes deleted: ${deletedCommentLikes.length}`);
    console.log(`  - Votes deleted: ${deletedVotes.length}`);
    console.log(`  - Notifications deleted: ${deletedNotifications.length}`);
    console.log(`  - Viral Notifications deleted: ${deletedViralNotifications.length}`);
    console.log(`  - Investors deleted: ${deletedInvestors.length}`);
    console.log(`  - Platform Fees deleted: ${deletedPlatformFees.length}`);
    console.log(`  - Pinned Posts deleted: ${deletedPinnedPosts.length}`);
    console.log('\n✅ All user accounts have been preserved.');
    console.log('✅ All encrypted media files in uploads/ folder remain (can be manually deleted if needed).');

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupAllContent()
  .then(() => {
    console.log('\nCleanup script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup script failed:', error);
    process.exit(1);
  });
