/**
 * React integration exports
 *
 * Provides React-specific hooks and components for UTM tracking.
 */

export { useUtmTracking, type UseUtmTrackingOptions } from './useUtmTracking'
export { UtmProvider, useUtmContext, type UtmProviderComponentProps } from './UtmProvider'
export { UtmHiddenFields, type UtmHiddenFieldsProps } from './UtmHiddenFields'
export { useUtmFormData, type UseUtmFormDataOptions } from './useUtmFormData'
export {
  UtmLinkDecorator,
  useUtmLinkDecorator,
  type UtmLinkDecoratorProps,
} from './UtmLinkDecorator'
