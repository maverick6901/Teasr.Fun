
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, User } from 'lucide-react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import type { User as UserType } from '@shared/schema';

interface UserSearchProps {
  onSelectUser?: (user: UserType) => void;
  className?: string;
}

export function UserSearch({ onSelectUser, className = '' }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ['/api/users/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  useEffect(() => {
    setShowResults(searchQuery.length >= 2 && users.length > 0);
  }, [searchQuery, users]);

  const handleSelectUser = (user: UserType) => {
    setSearchQuery('');
    setShowResults(false);
    onSelectUser?.(user);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-10"
          data-testid="input-user-search"
        />
      </div>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {users.map((user) => (
              <Link key={user.id} href={`/profile/${user.username}`}>
                <div
                  onClick={() => handleSelectUser(user)}
                  className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b border-border last:border-0"
                  data-testid={`search-result-${user.username}`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.profileImagePath || undefined} />
                    <AvatarFallback>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">@{user.username}</p>
                    {user.bio && (
                      <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
