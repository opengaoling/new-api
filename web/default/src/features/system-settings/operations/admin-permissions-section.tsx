/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getPermissionCatalog } from '@/features/users/api'
import {
  ADMIN_ROLE_KEY,
  normalizeAdminPermissions,
  type AdminPermissionMatrix,
} from '@/lib/admin-permissions'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const OPTION_KEY = 'authz.admin_role_permissions'

type AdminPermissionsSectionProps = {
  initialSerialized: string
}

type AdminPermissionsFormValues = {
  permissions: AdminPermissionMatrix
}

function parsePermissions(value: string): AdminPermissionMatrix | null {
  if (!value || !value.trim()) return null
  try {
    return JSON.parse(value) as AdminPermissionMatrix
  } catch {
    return null
  }
}

export function AdminPermissionsSection({
  initialSerialized,
}: AdminPermissionsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { data: catalog, isLoading } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: getPermissionCatalog,
  })

  const normalized = useMemo(() => {
    if (!catalog) return {}
    return normalizeAdminPermissions(parsePermissions(initialSerialized), catalog)
  }, [catalog, initialSerialized])

  const form = useForm<AdminPermissionsFormValues>({
    defaultValues: { permissions: normalized },
  })

  useEffect(() => {
    form.reset({ permissions: normalized })
  }, [form, normalized])

  const onSubmit = async (values: AdminPermissionsFormValues) => {
    await updateOption.mutateAsync({
      key: OPTION_KEY,
      value: JSON.stringify(values.permissions),
    })
  }

  const resetToDefault = () => {
    if (!catalog) return
    const baseline = catalog.roles.find((role) => role.key === ADMIN_ROLE_KEY)
    form.reset({ permissions: baseline?.grants ?? {} })
  }

  return (
    <SettingsSection title={t('Administrator permissions')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={resetToDefault}
            isSaving={updateOption.isPending || isLoading}
            resetLabel='Reset to built-in defaults'
            saveLabel='Save administrator permissions'
          />
          <div className='text-muted-foreground text-sm'>
            {t(
              'Configure the default permissions for ordinary administrators. Super administrators are not affected.'
            )}
          </div>
          <div className='space-y-4'>
            {catalog?.resources.map((resource) => (
              <div key={resource.resource} className='space-y-3 rounded-lg border p-4'>
                <div>
                  <div className='font-medium'>{t(resource.label_key)}</div>
                  <div className='text-muted-foreground text-sm'>
                    {t('Permissions in this group apply to ordinary administrators by default.')}
                  </div>
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  {resource.actions.map((action) => (
                    <FormField
                      key={action.action}
                      control={form.control}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      name={`permissions.${resource.resource}.${action.action}` as any}
                      render={({ field }) => (
                        <SettingsSwitchItem>
                          <SettingsSwitchContent>
                            <FormLabel>{t(action.label_key)}</FormLabel>
                            <FormDescription>
                              {t(action.description_key)}
                            </FormDescription>
                          </SettingsSwitchContent>
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(checked) => field.onChange(checked === true)}
                            />
                          </FormControl>
                        </SettingsSwitchItem>
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
