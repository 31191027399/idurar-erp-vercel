import * as actionTypes from './types';
import { request } from '@/request';

const dispatchSettingsData = (datas) => {
  const settingsCategory = {};

  datas.map((data) => {
    settingsCategory[data.settingCategory] = {
      ...settingsCategory[data.settingCategory],
      [data.settingKey]: data.settingValue,
    };
  });

  return settingsCategory;
};

const normalizeSettingsResponse = (data) => {
  if (data?.success === true && Array.isArray(data.result)) {
    return {
      success: true,
      payload: dispatchSettingsData(data.result),
    };
  }

  if (Array.isArray(data?.result) && data.message === 'Collection is Empty') {
    return {
      success: true,
      payload: dispatchSettingsData(data.result),
    };
  }

  return {
    success: false,
    payload: null,
  };
};

export const settingsAction = {
  resetState: () => (dispatch) => {
    dispatch({
      type: actionTypes.RESET_STATE,
    });
  },
  updateCurrency:
    ({ data }) =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.UPDATE_CURRENCY,
        payload: data,
      });
    },
  update:
    ({ entity, settingKey, jsonData }) =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.REQUEST_LOADING,
      });
      let data = await request.patch({
        entity: entity + '/updateBySettingKey/' + settingKey,
        jsonData,
      });

      if (data.success === true) {
        dispatch({
          type: actionTypes.REQUEST_LOADING,
        });

        let data = await request.listAll({ entity });

        const normalized = normalizeSettingsResponse(data);

        if (normalized.success === true) {
          window.localStorage.setItem('settings', JSON.stringify(normalized.payload));

          dispatch({
            type: actionTypes.REQUEST_SUCCESS,
            payload: normalized.payload,
          });
        } else {
          dispatch({
            type: actionTypes.REQUEST_FAILED,
          });
        }
      } else {
        dispatch({
          type: actionTypes.REQUEST_FAILED,
        });
      }
    },
  updateMany:
    ({ entity, jsonData }) =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.REQUEST_LOADING,
      });
      let data = await request.patch({
        entity: entity + '/updateManySetting',
        jsonData,
      });

      if (data.success === true) {
        dispatch({
          type: actionTypes.REQUEST_LOADING,
        });

        let data = await request.listAll({ entity });

        const normalized = normalizeSettingsResponse(data);

        if (normalized.success === true) {
          window.localStorage.setItem('settings', JSON.stringify(normalized.payload));

          dispatch({
            type: actionTypes.REQUEST_SUCCESS,
            payload: normalized.payload,
          });
        } else {
          dispatch({
            type: actionTypes.REQUEST_FAILED,
          });
        }
      } else {
        dispatch({
          type: actionTypes.REQUEST_FAILED,
        });
      }
    },
  list:
    ({ entity }) =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.REQUEST_LOADING,
      });

      let data = await request.listAll({ entity });

      const normalized = normalizeSettingsResponse(data);

      if (normalized.success === true) {
        window.localStorage.setItem('settings', JSON.stringify(normalized.payload));

        dispatch({
          type: actionTypes.REQUEST_SUCCESS,
          payload: normalized.payload,
        });
      } else {
        dispatch({
          type: actionTypes.REQUEST_FAILED,
        });
      }
    },
  upload:
    ({ entity, settingKey, jsonData }) =>
    async (dispatch) => {
      dispatch({
        type: actionTypes.REQUEST_LOADING,
      });

      let data = await request.upload({
        entity: entity,
        id: settingKey,
        jsonData,
      });

      if (data.success === true) {
        dispatch({
          type: actionTypes.REQUEST_LOADING,
        });

        let data = await request.listAll({ entity });

        const normalized = normalizeSettingsResponse(data);

        if (normalized.success === true) {
          window.localStorage.setItem('settings', JSON.stringify(normalized.payload));
          dispatch({
            type: actionTypes.REQUEST_SUCCESS,
            payload: normalized.payload,
          });
        } else {
          dispatch({
            type: actionTypes.REQUEST_FAILED,
          });
        }
      } else {
        dispatch({
          type: actionTypes.REQUEST_FAILED,
        });
      }
    },
};
