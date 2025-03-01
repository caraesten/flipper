/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React, {useEffect, useCallback, useMemo, useState} from 'react';
import {useDispatch, useStore} from '../utils/useStore';
import {Typography, Collapse, Button, Modal, Checkbox, Alert} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  WarningFilled,
  QuestionCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons';
import {Layout} from '../ui';
import {theme} from 'flipper-plugin';
import {
  startHealthchecks,
  updateHealthcheckResult,
  finishHealthchecks,
  acknowledgeProblems,
  resetAcknowledgedProblems,
} from '../reducers/healthchecks';
import runHealthchecks from '../utils/runHealthchecks';
import type {FlipperDoctor} from 'flipper-common';
type Healthchecks = FlipperDoctor.Healthchecks;
import {reportUsage} from 'flipper-common';

const {Title, Paragraph, Text} = Typography;

const statusTypeAndMessage: {
  [key in FlipperDoctor.HealthcheckStatus]: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  };
} = {
  IN_PROGRESS: {type: 'info', message: 'Doctor is running healthchecks...'},
  FAILED: {
    type: 'error',
    message:
      'Problems have been discovered with your installation. Please expand items for details.',
  },
  WARNING: {
    type: 'warning',
    message: 'Doctor has discovered warnings. Please expand items for details.',
  },
  SUCCESS: {
    type: 'success',
    message:
      'All good! Doctor has not discovered any issues with your installation.',
  },
  // This is deduced from default case (for completeness)
  SKIPPED: {
    type: 'success',
    message:
      'All good! Doctor has not discovered any issues with your installation.',
  },
};

function checkHasProblem(result: FlipperDoctor.HealthcheckResult) {
  return result.status === 'FAILED' || result.status === 'WARNING';
}

export function checkHasNewProblem(result: FlipperDoctor.HealthcheckResult) {
  return checkHasProblem(result) && !result.isAcknowledged;
}

function ResultTopDialog(props: {status: FlipperDoctor.HealthcheckStatus}) {
  const messages = statusTypeAndMessage[props.status];
  return (
    <Alert
      type={messages.type}
      showIcon
      message={messages.message}
      style={{
        fontSize: theme.fontSize.small,
        lineHeight: '16px',
        fontWeight: 'bold',
        paddingTop: '10px',
      }}
    />
  );
}

function CheckIcon(props: {status: FlipperDoctor.HealthcheckStatus}) {
  switch (props.status) {
    case 'SUCCESS':
      return (
        <CheckCircleFilled style={{fontSize: 24, color: theme.successColor}} />
      );
    case 'FAILED':
      return (
        <CloseCircleFilled style={{fontSize: 24, color: theme.errorColor}} />
      );
    case 'WARNING':
      return (
        <WarningFilled style={{fontSize: 24, color: theme.warningColor}} />
      );
    case 'SKIPPED':
      return (
        <QuestionCircleFilled
          style={{fontSize: 24, color: theme.disabledColor}}
        />
      );
    case 'IN_PROGRESS':
      return (
        <LoadingOutlined style={{fontSize: 24, color: theme.primaryColor}} />
      );
  }
}

function CollapsableCategory(props: {
  checks: Array<FlipperDoctor.HealthcheckReportItem>;
}) {
  return (
    <Collapse ghost>
      {props.checks.map((check) => (
        <Collapse.Panel
          key={check.key}
          header={check.label}
          extra={<CheckIcon status={check.result.status} />}>
          <Paragraph>{check.result.message}</Paragraph>
        </Collapse.Panel>
      ))}
    </Collapse>
  );
}

function HealthCheckList(props: {report: FlipperDoctor.HealthcheckReport}) {
  useEffect(() => reportUsage('doctor:report:opened'), []);
  return (
    <Layout.Container gap>
      <ResultTopDialog status={props.report.result.status} />
      {Object.values(props.report.categories).map((category) => (
        <Layout.Container key={category.key}>
          <Title level={3}>{category.label}</Title>
          <CollapsableCategory
            checks={
              category.result.status !== 'SKIPPED'
                ? Object.values(category.checks)
                : [
                    {
                      key: 'Skipped',
                      label: 'Skipped',
                      result: {
                        status: 'SKIPPED',
                        message: category.result.message,
                      },
                    },
                  ]
            }
          />
        </Layout.Container>
      ))}
    </Layout.Container>
  );
}

function SetupDoctorFooter(props: {
  onClose: () => void;
  onRerunDoctor: () => Promise<void>;
  showAcknowledgeCheckbox: boolean;
  acknowledgeCheck: boolean;
  onAcknowledgeCheck: (checked: boolean) => void;
  disableRerun: boolean;
}) {
  return (
    <Layout.Right>
      {props.showAcknowledgeCheckbox ? (
        <Checkbox
          checked={props.acknowledgeCheck}
          onChange={(e) => props.onAcknowledgeCheck(e.target.checked)}
          style={{display: 'flex', alignItems: 'center'}}>
          <Text style={{fontSize: theme.fontSize.small}}>
            Do not show warning about these problems at startup
          </Text>
        </Checkbox>
      ) : (
        <Layout.Container />
      )}
      <Layout.Horizontal>
        <Button onClick={props.onClose}>Close</Button>
        <Button
          type="primary"
          onClick={() => props.onRerunDoctor()}
          disabled={props.disableRerun}>
          Re-run
        </Button>
      </Layout.Horizontal>
    </Layout.Right>
  );
}

export default function SetupDoctorScreen(props: {
  visible: boolean;
  onClose: () => void;
}) {
  const healthcheckReport = useStore(
    (state) => state.healthchecks.healthcheckReport,
  );
  const settings = useStore((state) => state.settingsState);
  const dispatch = useDispatch();

  const [acknowlodgeProblem, setAcknowlodgeProblem] = useState(
    checkHasNewProblem(healthcheckReport.result),
  );
  const hasProblem = useMemo(
    () => checkHasProblem(healthcheckReport.result),
    [healthcheckReport],
  );
  const onCloseModal = useCallback(() => {
    const hasNewProblem = checkHasNewProblem(healthcheckReport.result);
    if (acknowlodgeProblem) {
      if (hasNewProblem) {
        reportUsage('doctor:report:closed:newProblems:acknowledged');
      }
      reportUsage('doctor:report:closed:acknowleged');
      dispatch(acknowledgeProblems());
    } else {
      if (hasNewProblem) {
        reportUsage('doctor:report:closed:newProblems:notAcknowledged');
      }
      reportUsage('doctor:report:closed:notAcknowledged');
      dispatch(resetAcknowledgedProblems());
    }
    props.onClose();
  }, [healthcheckReport.result, acknowlodgeProblem, props, dispatch]);
  const runDoctor = useCallback(async () => {
    await runHealthchecks({
      settings,
      startHealthchecks: (healthchecks: Healthchecks) =>
        dispatch(startHealthchecks(healthchecks)),
      updateHealthcheckResult: (
        categoryKey: string,
        itemKey: string,
        result: FlipperDoctor.HealthcheckResult,
      ) => dispatch(updateHealthcheckResult(categoryKey, itemKey, result)),
      finishHealthchecks: () => dispatch(finishHealthchecks()),
    });
  }, [settings, dispatch]);

  // This will act like componentDidMount
  useEffect(() => {
    runDoctor();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      width={570}
      title="Setup Doctor"
      visible={props.visible}
      destroyOnClose
      footer={
        <SetupDoctorFooter
          onClose={onCloseModal}
          onRerunDoctor={runDoctor}
          showAcknowledgeCheckbox={hasProblem}
          acknowledgeCheck={acknowlodgeProblem}
          onAcknowledgeCheck={(checked) => setAcknowlodgeProblem(checked)}
          disableRerun={healthcheckReport.result.status === 'IN_PROGRESS'}
        />
      }
      onCancel={onCloseModal}>
      <HealthCheckList report={healthcheckReport} />
    </Modal>
  );
}
