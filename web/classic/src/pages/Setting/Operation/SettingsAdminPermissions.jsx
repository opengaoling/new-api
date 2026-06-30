/*
Copyright (C) 2025 QuantumNous

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
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Checkbox, Col, Row, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Title } = Typography;

const OPTION_KEY = 'authz.admin_role_permissions';
const ADMIN_ROLE_KEY = 'admin';

function parsePermissions(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizePermissions(value, catalog) {
  const baseline = catalog?.roles?.find((role) => role.key === ADMIN_ROLE_KEY)?.grants || {};
  const normalized = {};
  for (const resource of catalog?.resources || []) {
    normalized[resource.resource] = {};
    for (const action of resource.actions || []) {
      normalized[resource.resource][action.action] =
        value?.[resource.resource]?.[action.action] ??
        baseline?.[resource.resource]?.[action.action] ??
        false;
    }
  }
  return normalized;
}

export default function SettingsAdminPermissions(props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialPermissions = useMemo(() => {
    return normalizePermissions(parsePermissions(props.options?.[OPTION_KEY]), catalog);
  }, [catalog, props.options]);

  async function loadCatalog() {
    setLoading(true);
    try {
      const res = await API.get('/api/authz/catalog');
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      setCatalog(data);
    } catch (error) {
      showError(t('权限配置加载失败'));
    } finally {
      setLoading(false);
    }
  }

  function setPermission(resource, action, checked) {
    setPermissions((prev) => ({
      ...prev,
      [resource]: {
        ...(prev[resource] || {}),
        [action]: checked,
      },
    }));
  }

  function resetToDefault() {
    const baseline = catalog?.roles?.find((role) => role.key === ADMIN_ROLE_KEY)?.grants || {};
    setPermissions(normalizePermissions(baseline, catalog));
    showSuccess(t('已重置为默认配置'));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await API.put('/api/option/', {
        key: OPTION_KEY,
        value: JSON.stringify(permissions),
      });
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('保存成功'));
      if (props.refresh) {
        await props.refresh();
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    setPermissions(initialPermissions);
  }, [initialPermissions]);

  return (
    <Card>
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <Title heading={5}>{t('普通管理员权限管理')}</Title>
          <Text type='tertiary'>
            {t('勾选普通管理员默认拥有的权限。超级管理员不受这里影响。')}
          </Text>
        </div>

        {(catalog?.resources || []).map((resource) => (
          <div key={resource.resource} style={{ marginBottom: 20 }}>
            <Title heading={6}>{t(resource.label_key)}</Title>
            <Row gutter={[16, 12]}>
              {(resource.actions || []).map((action) => (
                <Col span={12} key={action.action}>
                  <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 12 }}>
                    <Checkbox
                      checked={permissions?.[resource.resource]?.[action.action] === true}
                      onChange={(event) => setPermission(resource.resource, action.action, event.target.checked)}
                    >
                      {t(action.label_key)}
                    </Checkbox>
                    <div style={{ marginTop: 6 }}>
                      <Text type='tertiary' size='small'>
                        {t(action.description_key)}
                      </Text>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={resetToDefault}>{t('重置为默认配置')}</Button>
          <Button theme='solid' type='primary' loading={saving} onClick={save}>
            {t('保存普通管理员权限')}
          </Button>
        </div>
      </Spin>
    </Card>
  );
}
