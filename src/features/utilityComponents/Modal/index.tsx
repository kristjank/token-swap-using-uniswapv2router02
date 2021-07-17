import React, {useCallback} from 'react'
import ReactModal from 'react-modal'
import classNames from 'classnames'

import styles from './Modal.module.scss'

ReactModal.setAppElement('#root')

export type ModalProps = {
  isOpen: boolean
  windowClass?: string
  onRequestClose: (event: Event | React.SyntheticEvent) => void
}

const Modal: React.FC<ModalProps> = ({isOpen, windowClass, onRequestClose, children}) => {
  const onGetContentRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      node.addEventListener('click', (ev: MouseEvent) => {
        if (ev.target === node) {
          onRequestClose(ev)
        }
      })
    }
  }, [onRequestClose])

  return (
    <ReactModal isOpen={isOpen} onRequestClose={onRequestClose} contentRef={onGetContentRef} className={styles.modalContent}>
      <div className={classNames(styles.modalWindow, windowClass)}>
        <div>
          <button className={styles.closeButton} onClick={onRequestClose}>
            &#x2716;
          </button>
        </div>
        {children}
      </div>
    </ReactModal>
  )
}

export default Modal
