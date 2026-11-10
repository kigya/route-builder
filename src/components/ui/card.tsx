import type * as React from 'react';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { View } from 'react-native';

function Card({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>): React.JSX.Element {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn(
          'flex flex-col gap-6 rounded-xl border border-border bg-card py-6 shadow-sm shadow-black/5',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>): React.JSX.Element {
  return <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />;
}

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>): React.JSX.Element {
  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn('font-semibold leading-none', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>): React.JSX.Element {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>): React.JSX.Element {
  return <View className={cn('px-6', className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>): React.JSX.Element {
  return <View className={cn('flex flex-row items-center px-6', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
