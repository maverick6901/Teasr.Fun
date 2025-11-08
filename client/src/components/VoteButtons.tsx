import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  postId: string;
  upvoteCount: number;
  downvoteCount: number;
  userVote: 'up' | 'down' | null;
  onVote?: (postId: string, voteType: 'up' | 'down' | null) => void;
}

export function VoteButtons({ postId, upvoteCount, downvoteCount, userVote, onVote }: VoteButtonsProps) {
  const [localVote, setLocalVote] = useState<'up' | 'down' | null>(userVote);
  const [localUpvotes, setLocalUpvotes] = useState(upvoteCount);
  const [localDownvotes, setLocalDownvotes] = useState(downvoteCount);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const voteMutation = useMutation({
    mutationFn: async (voteType: 'up' | 'down' | null) => {
      const walletAddress = (window as any).walletAddress;
      if (!walletAddress) {
        throw new Error('Please connect your wallet to vote');
      }

      const response = await fetch(`/api/posts/${postId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ voteType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
      }

      return response.json();
    },
    onSuccess: (data, voteType) => {
      // Update local counts safely without double incrementing
      setLocalVote((prev) => {
        let newUpvotes = localUpvotes;
        let newDownvotes = localDownvotes;

        // Undo previous vote
        if (prev === 'up') newUpvotes--;
        if (prev === 'down') newDownvotes--;

        // Apply new vote
        if (voteType === 'up') newUpvotes++;
        if (voteType === 'down') newDownvotes++;

        setLocalUpvotes(newUpvotes);
        setLocalDownvotes(newDownvotes);

        return voteType;
      });

      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });

      // Only call onVote if it exists, and don’t double update UI
      if (onVote) onVote(postId, voteType);
    },
    onError: (error: Error) => {
      console.error('Vote error:', error);
      toast({
        title: 'Vote failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleVote = (voteType: 'up' | 'down') => {
    if (localVote === voteType) {
      // If user clicks same vote again, remove vote
      voteMutation.mutate(null);
      return;
    }
    voteMutation.mutate(voteType);
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={localVote === 'up' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleVote('up')}
        className={cn(
          "px-3 py-2 min-h-8",
          localVote === 'up' && "bg-primary text-primary-foreground"
        )}
        data-testid={`button-upvote-${postId}`}
        disabled={voteMutation.isPending}
      >
        <ThumbsUp className="w-4 h-4 mr-1" />
        <span className="font-semibold">{localUpvotes}</span>
      </Button>

      <Button
        variant={localVote === 'down' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => handleVote('down')}
        className={cn(
          "px-3 py-2 min-h-8",
          localVote === 'down' && "bg-destructive text-destructive-foreground"
        )}
        data-testid={`button-downvote-${postId}`}
        disabled={voteMutation.isPending}
      >
        <ThumbsDown className="w-4 h-4 mr-1" />
        <span className="font-semibold">{localDownvotes}</span>
      </Button>
    </div>
  );
}
