# Recommendations Feature Guide

## Overview

The Recommendations feature allows family and friends to share movie and TV show suggestions with each other. It's designed for small groups (less than 20 people) who want a personal way to share what they're watching.

## How to Use

### Sending a Recommendation

1. **Find Content**: Browse or search for a movie or TV show you want to recommend
2. **Go to Details**: Click on the content to view its detail page
3. **Click Recommend Button**: Look for the blue "Recommend to Friends" button below the watchlist status buttons
4. **Select Recipients**:
   - Browse or search for friends in the modal
   - Select multiple friends if you want (multi-select)
   - Selected users will be highlighted in blue
5. **Add a Message** (Optional): Include a personal note explaining why you recommend it
6. **Send**: Click "Send to X" button to send the recommendations

### Viewing Received Recommendations

1. **Navigate to Recommendations**:
   - Desktop: Click "Recommendations" in the top navigation
   - Mobile: Tap the "Recs" icon in the bottom navigation
2. **Check the Badge**: Red badge shows number of pending recommendations
3. **View Details**: Each recommendation shows:
   - Movie/TV show poster and title
   - Who recommended it and when
   - Personal message (if included)
   - Current status badge
4. **Take Action**: For pending recommendations, you can:
   - **Add to Watchlist**: Mark it to watch later
   - **Already Watched**: Mark if you've seen it
   - **Not Interested**: Dismiss the recommendation

### Checking Sent Recommendations

1. **Switch to "Sent" Tab**: Click the "Sent" tab on the Recommendations page
2. **View Status**: See which recommendations you've sent and their current status
3. **Track Engagement**: See if friends have viewed, added, or watched your recommendations

## Recommendation Statuses

### For Recipients:
- **Pending** (Yellow): New recommendation, not yet viewed
- **Viewed** (Purple): You've seen the recommendation
- **Added** (Blue): Added to your watchlist
- **Watched** (Green): Marked as already watched
- **Dismissed** (Gray): Marked as not interested

### Real-time Updates

The app uses real-time updates, so:
- Your notification badge updates instantly when you receive new recommendations
- Status changes are reflected immediately
- No need to refresh the page

## Use Cases

### Family Movie Night
Dad recommends "The Incredibles" to the kids with message: "Perfect for family movie night this Friday!"

### Shared Interests
Friend recommends "Breaking Bad" with: "Since you loved Better Call Saul, you HAVE to watch this!"

### Discovering New Content
Sister recommends a Korean drama: "Trust me on this one, it's amazing even with subtitles"

### Avoiding Spoilers
Friend recommends "Inception" with: "Don't read anything about it, just watch!"

## Tips

1. **Be Specific in Messages**: Explain why you're recommending something
2. **Use Multi-Select**: Recommend to multiple friends at once if it suits everyone
3. **Check Status**: See if friends have watched your recommendations on the Sent tab
4. **Respond Promptly**: Check your recommendations regularly to keep the conversation going
5. **Personal Touch**: Add context like "reminded me of you" or "we should watch together"

## Privacy & Control

- Only you can see recommendations sent to you
- Only you and the recipient can see your sent recommendations
- You can choose which friends to recommend to (no public recommendations)
- All recommendations are private between sender and recipient

## Technical Details

### Database Structure
- Recommendations table stores all recommendation data
- Includes sender, recipient, content, message, and status
- Timestamps track when sent, viewed, and actioned
- Row Level Security ensures privacy

### Real-time Features
- Uses Supabase real-time subscriptions
- Notification badge updates without page refresh
- Status changes propagate instantly

### Status Workflow
```
[Pending] → User views → [Viewed]
          ↓
    User takes action
          ↓
[Added] / [Watched] / [Dismissed]
```

## Troubleshooting

**Badge not updating?**
- Refresh the page
- Check your internet connection

**Can't find a user?**
- They need to create an account first
- Use the search box to filter users

**Recommendation not showing?**
- Check if you're on the correct tab (Received vs Sent)
- Verify the recommendation was sent successfully

**Want to delete a sent recommendation?**
- Currently not supported (coming soon)
- Recipient can dismiss recommendations

## Future Enhancements

Potential improvements:
- Delete sent recommendations
- Edit recommendations before recipient views
- Bulk actions (dismiss all, add all to watchlist)
- Recommendation threads/discussions
- Push notifications for new recommendations
- Weekly digest of recommendations
- Popular recommendations among your group

## Best Practices

1. **Quality over Quantity**: Don't spam friends with too many recommendations
2. **Context Matters**: Always explain why you're recommending something
3. **Respect Preferences**: Remember what friends like and don't like
4. **Follow Up**: Ask if they watched your recommendation
5. **Be Open**: Try recommendations from friends even if outside your usual taste
6. **Respond**: Let friends know if you watched their recommendation
7. **Group Recommendations**: Recommend the same content to multiple friends for group watch parties

## Integration with Other Features

### Watchlist Integration
- "Add to Watchlist" action automatically adds content to your watchlist
- Check your Dashboard to see added recommendations

### Social Features
- Follow friends to stay updated on their activity
- Combined with following, creates a tight-knit viewing community

### Lists
- Create a custom list called "Friend Recommendations"
- Manually add recommended content for reference

## Privacy Considerations

- Recommendations are **completely private** between sender and recipient
- No one else can see what you've recommended or received
- Status updates are only visible to you and the other person involved
- Your watchlist and viewing history remain private

## Perfect for Small Groups

This feature is specifically designed for:
- Family members
- Close friend groups
- Partner/spouse content sharing
- Small watch groups (book clubs, etc.)
- Trusted circles

It's NOT designed for:
- Public recommendations
- Large communities
- Influencer-style sharing
- Marketing or promotional use

The intimate nature makes recommendations more meaningful and personal.
